import './page.css';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as jose from 'jose';
import DashboardClient from './DashboardClient';
import prisma from '@/lib/prisma';
import { getPayPool, sql } from '@/lib/payDb';

async function getEmployeeName(empcode) {
  if (!empcode || empcode === 'Member') return empcode;

  try {
    const emp = await prisma.iTFormsEmpMast.findUnique({
      where: { EmpCode: empcode.trim() },
    });
    if (emp && emp.EmpName) {
      return emp.EmpName.trim();
    }
  } catch (err) {
    console.error('Error fetching employee name from ITFormsEmpMast:', err);
  }

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

  if (!token) {
    redirect('/login');
  }

  let user = null;
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
    redirect('/login');
  }

  if (!user || !user.username || user.username === 'Member') {
    redirect('/login');
  }

  // Double-check authorization against ITFormsEmpMast
  const authorized = await prisma.iTFormsEmpMast.findUnique({
    where: { EmpCode: user.username },
  });

  if (!authorized) {
    redirect('/login');
  }

  const empName = authorized.EmpName?.trim() || (await getEmployeeName(user.username));

  return <DashboardClient empName={empName} />;
}
