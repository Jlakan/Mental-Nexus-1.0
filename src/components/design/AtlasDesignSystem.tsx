// src/components/design/AtlasDesignSystem.tsx
import React from 'react';

// =============================================================================
// 1. ICONOS (ATLAS ICONS)
// =============================================================================

// Componente base para los iconos SVG para mantener tamaño y estilo consistente
const IconBase = ({ path, className = "", size = 24, ...props }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`inline-block ${className}`}
    {...props}
  >
    {path}
  </svg>
);

export const AtlasIcons = {
  // UI Básico
  User: (props: any) => (
    <IconBase {...props} path={
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    } />
  ),
  Lock: (props: any) => (
    <IconBase {...props} path={
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    } />
  ),
  Shield: (props: any) => (
    <IconBase {...props} path={
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    } />
  ),
  Search: (props: any) => (
    <IconBase {...props} path={
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    } />
  ),
  Menu: (props: any) => (
    <IconBase {...props} path={
      <>
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </>
    } />
  ),
  Close: (props: any) => (
    <IconBase {...props} path={
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    } />
  ),
  Settings: (props: any) => (
    <IconBase {...props} path={
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    } />
  ),

  // RPG / Stats / Gamificación
  Zap: (props: any) => (
    <IconBase {...props} path={
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    } />
  ), // Energía/XP
  
  Brain: (props: any) => (
    <IconBase {...props} path={
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    } />
  ),
  
  Heart: (props: any) => (
    <IconBase {...props} path={
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    } />
  ),

  Sword: (props: any) => (
    <IconBase {...props} path={
      <> {/* Aquí estaba el error, ahora corregido con Fragments */}
        <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
        <path d="M13 19l6-6" />
        <path d="M16 16l4 4" />
        <path d="M19 21l2-2" />
      </>
    } />
  ),
  
  Target: (props: any) => (
    <IconBase {...props} path={
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </>
    } />
  ),
};

// =============================================================================
// 2. COMPONENTES UI (ATLAS UI)
// =============================================================================

// --- TARJETAS ---
export const AtlasCard = ({ children, className = "", noPadding = false }: any) => {
  return (
    <div className={`bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-xl shadow-xl overflow-hidden ${className}`}>
      <div className={noPadding ? "" : "p-6"}>
        {children}
      </div>
    </div>
  );
};

// --- BOTONES ---
interface AtlasButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

export const AtlasButton = ({ children, variant = 'primary', className = "", isLoading, ...props }: AtlasButtonProps) => {
  const baseStyles = "relative inline-flex items-center justify-center px-6 py-2 overflow-hidden font-bold rounded-lg group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-cyan-600 text-white hover:bg-cyan-500 shadow-[0_0_15px_rgba(8,145,178,0.5)] border border-cyan-400/30",
    secondary: "bg-transparent border border-slate-500 text-slate-300 hover:text-white hover:border-white hover:bg-slate-800",
    danger: "bg-red-900/20 border border-red-500/50 text-red-400 hover:bg-red-900/40 hover:text-red-300",
    ghost: "bg-transparent text-slate-400 hover:text-white"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {isLoading ? (
        <span className="flex items-center gap-2">
           <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
           PROCESANDO...
        </span>
      ) : children}
    </button>
  );
};

// --- TEXTOS ---
export const AtlasText = ({ children, variant = 'body', className = "" }: any) => {
  const styles: any = {
    h1: "text-3xl md:text-4xl font-bold text-white tracking-tight",
    h2: "text-xl md:text-2xl font-semibold text-cyan-50",
    h3: "text-lg font-medium text-cyan-100/90",
    body: "text-slate-300 leading-relaxed",
    code: "font-mono text-xs text-cyan-400/80 tracking-widest uppercase"
  };

  return <div className={`${styles[variant]} ${className}`}>{children}</div>;
};

// --- INPUTS ---
export const AtlasInput = ({ label, icon, ...props }: any) => {
  return (
    <div className="mb-4">
      {label && <label className="block text-xs font-mono text-slate-400 mb-1 uppercase tracking-wider">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors">
            {icon}
          </div>
        )}
        <input 
          className={`w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 ${icon ? 'pl-10' : 'pl-4'} pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-all`}
          {...props}
        />
      </div>
    </div>
  );
};