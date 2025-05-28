/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '*.ngrok-free.app',
    '*.ngrok.io',
    '*.ngrok.app',
    // Add other tunnel services if needed
    '*.loca.lt', // localtunnel
  ],
};

export default nextConfig;