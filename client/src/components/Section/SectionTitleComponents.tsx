import React from 'react'

interface SectionTitleComponentsProps {
    title: string;
    children: React.ReactNode;
}

export default function SectionTitleComponents({ title, children }: SectionTitleComponentsProps) {
    return (
        <>
            {/* Top section with title and custom filter toggle */}
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-black" data-testid="text-page-title">{title}</h1>
                {children}
            </div>
        </>
    )
}
