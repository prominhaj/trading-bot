import Dashboard from './components/Dashboard';

export const metadata = {
    title: 'Dashboard',
    description: 'Trading Bot Dashboard',
    keywords: ['trading bot', 'crypto', 'dashboard']
};

const DashboardPage = () => {
    return (
        <div>
            <Dashboard />
        </div>
    );
};

export default DashboardPage;
