import { MetadataRoute } from 'next';


export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "File Sharing App",
    short_name: "File Sharing",
    description: "A simple file sharing app host on my own server",
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}