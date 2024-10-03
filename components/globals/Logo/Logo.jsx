import logo from "@/assets/logo.png"
import Image from "next/image";
import Link from "next/link";

const Logo = () => {
    return (
        <Link
            href="/"
            className="flex items-center justify-center gap-1 text-lg font-semibold rounded-full group h-9 w-9 shrink-0 bg-primary text-primary-foreground md:h-8 md:w-8 md:text-base"
        >
            <Image className="w-full h-full rounded-full" src={logo} width={24} height={24} alt="Logo" />
        </Link>
    );
};

export default Logo;