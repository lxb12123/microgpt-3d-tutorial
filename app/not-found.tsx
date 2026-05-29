import Link from 'next/link';

export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <h1>404 — Page Not Found</h1>
        <p>
          <Link href="/microgpt-3d-tutorial/">Go home</Link>
        </p>
      </body>
    </html>
  );
}
