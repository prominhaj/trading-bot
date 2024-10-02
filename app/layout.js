import './globals.css';

export const metadata = {
    title: 'Trading Bot'
};

export default async function RootLayout({ children }) {
    return (
        <html lang='en'>
            <body>{children}</body>
        </html>
    );
}
