import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../components/auth-context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["400", "700", "900"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "Gymie Web",
  description: "Gymie MVP web application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body className={`${inter.variable} ${manrope.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
