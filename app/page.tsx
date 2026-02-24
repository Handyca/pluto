import { redirect } from 'next/navigation';

export default function Page() {
  // Redirect root to admin login so the site only shows the admin login page
  redirect('/admin/login');
}

