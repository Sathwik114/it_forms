import './page.css';
import { cookies } from 'next/headers';
import * as jose from 'jose';
import DashboardClient from './DashboardClient';
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

  return <DashboardClient empName={empName} />;
}
