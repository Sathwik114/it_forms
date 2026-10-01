import './page.css';
import { cookies } from 'next/headers';
import * as jose from 'jose';
import LogoutButton from './LogoutButton';
import ServerRoomChecklist from './ITTemparature/tempareture';
import { getPayPool, sql } from '@/lib/payDb';

async function getEmployeeName(empcode) {
  if (!empcode || empcode === 'Member') return empcode;
  try {
    const pool = await getPayPool();
    const result = await pool.request()
      .input('empcode', sql.VarChar, empcode.trim())
      .query('SELECT EMPNAME FROM payroll.dbo.EMPMAST WHERE EMPCODE = @empcode');

    if (result.recordset && result.recordset.length > 0) {
      return result.recordset[0].EMPNAME?.trim() || empcode;
    }
  } catch (err) {
    console.error('Error fetching employee name:', err);
  }
  return empcode;
}

export default async function Dashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  let user = { name: 'Member', email: 'Not available', username: 'Member' };

  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jose.jwtVerify(token, secret);
      user = {
        ...payload,
        name: payload.name || payload.username || 'Member',
        username: payload.username || payload.name || 'Member',
        email: payload.email || 'Not available',
      };
    } catch (error) {
      console.error('Failed to decrypt auth token:', error);
    }
  }

  let empName = user.username;
  if (token && user.username && user.username !== 'Member') {
    empName = await getEmployeeName(user.username);
  }

  return (
    <div className="dashboard-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f2f2f2', color: '#333333' }}>
      {/* Fixed Navbar */}
      <nav
        className="no-print"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          height: '56px',
          boxSizing: 'border-box',
          fontFamily: 'Arial, sans-serif',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          borderBottom: '1px solid #cccccc',
          backgroundColor: '#f8f9fa',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>IT Forms Management System</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '13px' }}>
            Hello, <strong>{empName}</strong>
          </span>
          <LogoutButton />
        </div>
      </nav>

      {/* Main Container */}
      <main className="dashboard-main" style={{ flex: 1, paddingTop: '56px' }}>
        <style>{`@media print { .dashboard-root { background-color: #ffffff !important; min-height: 0 !important; } .dashboard-main { padding-top: 0 !important; } }`}</style>
        <ServerRoomChecklist />
      </main>
    </div>
  );
}