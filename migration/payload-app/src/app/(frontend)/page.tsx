import { redirect } from 'next/navigation'

// The Payload service has no public frontend of its own — the site lives on the
// (framtid.)ekko.no frontend. Send the bare domain (admin.ekko.no/) to the
// admin login instead of Next's 404.
export default function Root() {
  redirect('/admin')
}
