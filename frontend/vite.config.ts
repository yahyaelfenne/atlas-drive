import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({plugins:[react(),tailwindcss()],server:{port:5273,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:5180',changeOrigin:true},'/hubs':{target:'http://127.0.0.1:5180',changeOrigin:true,ws:true}}}})
