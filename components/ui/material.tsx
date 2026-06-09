import React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string;
  size?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={`material-button ${className || ""} ${variant || ""} ${size || ""}`} ref={ref} {...props} />
  )
)
Button.displayName = "Button"

export interface BoxProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const Box = ({ children, className, ...props }: BoxProps) => (
  <div className={`material-box ${className || ""}`} {...props}>
    {children}
  </div>
)

export interface FormControlLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  control: React.ReactNode;
  label: React.ReactNode;
}

export const FormControlLabel = ({ control, label, className, ...props }: FormControlLabelProps) => (
  <label className={`material-form-control-label ${className || ""}`} {...props}>
    {control}
    <span>{label}</span>
  </label>
)

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <input type="checkbox" className={`material-switch ${className || ""}`} ref={ref} {...props} />
  )
)
Switch.displayName = "Switch"
