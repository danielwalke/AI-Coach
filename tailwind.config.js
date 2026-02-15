/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: 'var(--color-bg)',
                surface: 'var(--color-surface)',
                'surface-highlight': 'var(--color-surface-highlight)',
                primary: 'var(--color-primary)',
                'primary-dark': 'var(--color-primary-dark)',
                secondary: 'var(--color-secondary)',
                text: 'var(--color-text)',
                muted: 'var(--color-text-muted)',
                danger: 'var(--color-danger)',
                border: 'var(--color-border)',
            },
            borderRadius: {
                sm: 'var(--radius-sm)',
                md: 'var(--radius-md)',
                lg: 'var(--radius-lg)',
                full: 'var(--radius-full)',
            },
            fontFamily: {
                sans: 'var(--font-sans)',
            }
        },
    },
    plugins: [],
}
