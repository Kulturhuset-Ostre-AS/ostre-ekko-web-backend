// Minimal root layout for the (frontend) group — create-payload-app convention.
// The only page here is the root redirect to /admin.
export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  )
}
