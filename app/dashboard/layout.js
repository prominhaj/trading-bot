import Header from './components/Header/Header';
import SideBar from './components/SideBar/SideBar';

const DashboardLayout = ({ children }) => {
    return (
        <div className='flex flex-col w-full min-h-screen bg-muted/40'>
            <SideBar />
            <div className='flex flex-col sm:gap-4 sm:py-4 sm:pl-14'>
                <Header />
                {children}
            </div>
        </div>
    );
};

export default DashboardLayout;
