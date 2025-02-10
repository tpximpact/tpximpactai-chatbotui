import { ChevronRightIcon } from '@heroicons/react/24/outline'

interface AccordionProps {
    isOpen: boolean;
    onClick: () => void;
    size?: number;
}

export const Accordion = ({ isOpen, onClick, size = 20 }: AccordionProps) => {
    return (
        <ChevronRightIcon 
            onClick={onClick}
            style={{
                transition: 'transform 0.2s ease-in-out',
                transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                width: `${size}px`,
                height: `${size}px`,
            }}
        />
    )
}