import * as React from 'react'
import { cn } from '../../lib'
export const Input=React.forwardRef<HTMLInputElement,React.InputHTMLAttributes<HTMLInputElement>>(({className,...props},ref)=><input ref={ref} className={cn('input',className)} {...props}/>);Input.displayName='Input'
export const Select=React.forwardRef<HTMLSelectElement,React.SelectHTMLAttributes<HTMLSelectElement>>(({className,...props},ref)=><select ref={ref} className={cn('input select',className)} {...props}/>);Select.displayName='Select'
