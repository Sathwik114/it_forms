import { NextResponse } from 'next/server';
import * as jose from 'jose';
import ldap from 'ldapjs';

function buildCandidateDns(username, baseDN) {
  const normalized = (username || '').trim();
  if (!normalized) return [];

  const parts = [normalized];
  if (normalized.includes('\\')) parts.push(normalized.split('\\').pop());
  if (normalized.includes('@')) parts.push(normalized.split('@')[0]);

  const domain = (process.env.LDAP_DOMAIN || '').trim();
  const derivedDomain = baseDN
    ? baseDN
        .split(',')
        .filter((part) => part.toLowerCase().startsWith('dc='))
        .map((part) => part.split('=').pop())
        .join('.')
    : '';

  const domainSuffix = domain || derivedDomain;
  const candidates = new Set();
  parts.forEach((part) => {
    const cleanPart = part.trim();
    if (!cleanPart) return;

    candidates.add(cleanPart);
    if (domainSuffix) {
      candidates.add(`${cleanPart}@${domainSuffix}`);
    }

    if (baseDN) {
      candidates.add(`CN=${cleanPart},${baseDN}`);
      candidates.add(`cn=${cleanPart},${baseDN}`);
      candidates.add(`uid=${cleanPart},${baseDN}`);
      candidates.add(`sAMAccountName=${cleanPart},${baseDN}`);
      candidates.add(`${cleanPart},${baseDN}`);
    }
  });

  const template = process.env.LDAP_BIND_TEMPLATE?.trim();
  if (template) {
    const rendered = template
      .replace('{username}', normalized)
      .replace('{domain}', domainSuffix)
      .replace('{baseDN}', baseDN || '');
    if (rendered) candidates.add(rendered);
  }

  return Array.from(candidates);
}

function ldapAuthenticate(username, password) {
  return new Promise((resolve, reject) => {
    const ldapHost = process.env.LDAP_HOST?.trim();
    const ldapPort = process.env.LDAP_PORT?.trim();
    let ldapUrl = process.env.LDAP_URL?.trim();
    if (!ldapUrl && ldapHost) ldapUrl = `ldap://${ldapHost}:${ldapPort || '389'}`;
    const baseDN = process.env.LDAP_BASE_DN?.trim();

    if (!ldapUrl || !baseDN) {
      return reject(new Error('LDAP server is not configured'));
    }

    const client = ldap.createClient({
      url: ldapUrl,
      connectTimeout: 10000,
      timeout: 5000,
    });

    let settled = false;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      callback();
    };

    client.on('error', (err) => {
      if (!settled) {
        finish(() => reject(new Error('LDAP connection failed: ' + err.message)));
      }
    });

    const candidateDns = buildCandidateDns(username, baseDN);
    if (!candidateDns.length) {
      return finish(() => reject(new Error('LDAP bind DN could not be constructed')));
    }

    if (process.env.LDAP_DEBUG === 'true') {
      try {
        console.info('LDAP candidate DNs:', candidateDns);
      } catch (e) {}
    }

    let lastError = null;

    const tryNextBind = (index) => {
      if (index >= candidateDns.length) {
        return finish(() => reject(lastError || new Error('Invalid username or password')));
      }

      const bindValue = candidateDns[index];
      client.bind(bindValue, password, (err) => {
        if (err) {
          if (process.env.LDAP_DEBUG === 'true') console.info('LDAP bind failed for', bindValue, err && err.message);
          lastError = new Error('Invalid username or password');
          return tryNextBind(index + 1);
        }

        client.unbind(() => {
          finish(() => resolve(bindValue));
        });
      });
    };

    tryNextBind(0);
  });
}

function ldapSearchThenBind(username, password) {
  return new Promise((resolve, reject) => {
    const ldapHost = process.env.LDAP_HOST?.trim();
    const ldapPort = process.env.LDAP_PORT?.trim();
    let ldapUrl = process.env.LDAP_URL?.trim();
    if (!ldapUrl && ldapHost) ldapUrl = `ldap://${ldapHost}:${ldapPort || '389'}`;
    const baseDN = process.env.LDAP_BASE_DN?.trim();
    if (!ldapUrl || !baseDN) return reject(new Error('LDAP server is not configured'));

    const client = ldap.createClient({ url: ldapUrl, connectTimeout: 10000, timeout: 5000 });
    let settled = false;
    const finish = (cb) => { if (settled) return; settled = true; cb(); };

    client.on('error', (err) => {
      if (!settled) finish(() => reject(new Error('LDAP connection failed: ' + err.message)));
    });

    const serviceDn = process.env.LDAP_BIND_DN?.trim();
    const servicePass = process.env.LDAP_BIND_PASSWORD;

    const performSearch = () => {
      const filterTemplate = process.env.LDAP_SEARCH_FILTER || '(|(cn={u})(sAMAccountName={u})(uid={u})(userPrincipalName={u}))';
      const filter = filterTemplate.replace(/\{u\}/g, username);
      if (process.env.LDAP_DEBUG === 'true') {
        try {
          console.info('LDAP search filter:', filter);
          console.info('LDAP baseDN:', baseDN, 'LDAP URL:', ldapUrl);
        } catch (e) {}
      }
      const opts = { filter, scope: 'sub', attributes: ['dn', 'cn', 'mail', 'sAMAccountName', 'userPrincipalName'] };

      client.search(baseDN, opts, (err, res) => {
        if (err) return finish(() => reject(new Error('LDAP search failed: ' + err.message)));

        let found = null;
        res.on('searchEntry', (entry) => { if (!found) found = entry; if (process.env.LDAP_DEBUG === 'true') console.info('LDAP searchEntry:', (entry && (entry.objectName || entry.dn || (entry.pojo && entry.pojo.dn))) || entry); });
        res.on('error', (err) => { if (process.env.LDAP_DEBUG === 'true') console.info('LDAP search error event:', err && err.message); if (!settled) finish(() => reject(new Error('LDAP search error: ' + err.message))); });
        res.on('end', () => {
          if (!found) return finish(() => reject(new Error('User not found in LDAP')));
          const userDn = found.objectName || found.dn || (found.pojo && found.pojo.dn);
          if (process.env.LDAP_DEBUG === 'true') console.info('LDAP found DN:', userDn);
          if (!userDn) return finish(() => reject(new Error('Could not determine user DN from search result')));

          // attempt bind as user to validate password
          client.bind(userDn, password, (err) => {
            client.unbind(() => {
              if (err) {
                if (process.env.LDAP_DEBUG === 'true') console.info('LDAP user bind failed for', userDn, err && err.message);
                return finish(() => reject(new Error('Invalid username or password')));
              }
              return finish(() => resolve(userDn));
            });
          });
        });
      });
    };

    if (serviceDn && servicePass) {
      client.bind(serviceDn, servicePass, (err) => {
        if (err) return finish(() => reject(new Error('Service account bind failed: ' + err.message)));
        performSearch();
      });
    } else {
      performSearch();
    }
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const username = body.username || body.userId;
    const password = body.password;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    let userDN;
    try {
      try {
        userDN = await ldapAuthenticate(username, password);
      } catch (errDirect) {
        // fallback to search-then-bind if direct binds fail or server doesn't allow them
        try {
          userDN = await ldapSearchThenBind(username, password);
        } catch (errSearch) {
          // prefer the more specific message if available
          const msg = errSearch?.message || errDirect?.message || 'Invalid username or password';
          throw new Error(msg);
        }
      }
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT secret is not configured. Set JWT_SECRET in your environment.');
      return NextResponse.json({ error: 'Server misconfiguration: JWT secret not set' }, { status: 500 });
    }

    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new jose.SignJWT({
      id: userDN,
      username,
      name: username,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(secret);

    const response = NextResponse.json(
      { message: 'Logged in successfully', username },
      { status: 200 }
    );

    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 2,
    });

    return response;
  } catch (error) {
    console.error('LDAP login error:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred during login' },
      { status: 500 }
    );
  }
}