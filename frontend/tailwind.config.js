export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            fontFamily: {
                body: ['Syne', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                bg: {
                    DEFAULT: '#070d1a',
                    2: '#0d1528',
                    3: '#111e35',
                    4: '#162240',
                },
                border: {
                    DEFAULT: '#1e2d4a',
                    2: '#2a3d5e',
                },
                txt: {
                    DEFAULT: '#e8eef8',
                    2: '#9aaec8',
                    3: '#5a7494',
                    4: '#3a5070',
                },
                // Region colors from the map
                americas: '#e8294a',
                s_america: '#e8721a',
                europe: '#2ebc6e',
                russia: '#6b2fc4',
                africa: '#e8b418',
                m_east: '#d42090',
                india_c: '#e86820',
                c_asia: '#18a89e',
                e_asia: '#18b8d8',
                se_asia: '#38b848',
                oceania: '#2855e8',
                // UI
                brand: {
                    DEFAULT: '#2563eb',
                    dark: '#1d4ed8',
                    light: 'rgba(37,99,235,0.15)',
                },
                danger: {
                    DEFAULT: '#e8294a',
                    light: 'rgba(232,41,74,0.15)',
                },
                success: {
                    DEFAULT: '#2ebc6e',
                    light: 'rgba(46,188,110,0.15)',
                },
                warn: {
                    DEFAULT: '#e8b418',
                    light: 'rgba(232,180,24,0.15)',
                },
                purp: {
                    DEFAULT: '#6b2fc4',
                    light: 'rgba(107,47,196,0.15)',
                },
            },
        },
    },
    plugins: [],
}