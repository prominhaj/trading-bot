import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Fragment } from 'react';

const BreadcrumbSection = ({ items, className }) => {
    return (
        <Breadcrumb className={cn(className)}>
            <BreadcrumbList>
                {
                    items?.map((item, index) => (
                        <Fragment key={index}>
                            <BreadcrumbItem>
                                {item?.href ? (
                                    <Link href={item.href}>
                                        {item.label}
                                    </Link>
                                ) : (
                                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                                )}
                            </BreadcrumbItem>
                            {
                                !item?.current && <BreadcrumbSeparator key={`separator-${index}`} />
                            }
                        </Fragment>
                    ))
                }
            </BreadcrumbList>
        </Breadcrumb>
    );
};

export default BreadcrumbSection;
