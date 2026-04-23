import axios from 'axios'

const client = axios.create({
    baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:8000',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
})

// Request interceptor
client.interceptors.request.use(
    config => {
        console.log(`→ ${config.method?.toUpperCase()} ${config.url}`)
        return config
    },
    error => Promise.reject(error)
)

// Response interceptor
client.interceptors.response.use(
    response => response.data,
    error => {
        console.error('API Error:', error.response?.data || error.message)
        return Promise.reject(error)
    }
)

export default client