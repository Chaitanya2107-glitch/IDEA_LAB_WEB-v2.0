
import { Event, GalleryItem, Project } from './types';

export const EVENTS: Pick<Event, 'id' | 'title' | 'date' | 'location' | 'description' | 'category' | 'imageUrl'>[] = [
  {
    id: '1',
    title: 'AI & Robotics Workshop 2024',
    date: new Date('2024-11-15T09:00:00'),
    location: 'Main Auditorium, Block A',
    description: 'A comprehensive hands-on workshop on the latest trends in Artificial Intelligence and Robotics integration.',
    category: 'Workshop',
    imageUrl: 'https://picsum.photos/seed/robot/800/600',
  },
  {
    id: '2',
    title: 'Idea-thon: Smart Cities',
    date: new Date('2024-12-05T10:00:00'),
    location: 'Innovation Hub',
    description: 'A 24-hour hackathon aimed at solving urban challenges using IoT and Data Analytics.',
    category: 'Hackathon',
    imageUrl: 'https://picsum.photos/seed/city/800/600',
  },
  {
    id: '3',
    title: 'Future Tech Seminar',
    date: new Date('2024-10-20T14:00:00'),
    location: 'Virtual Hall 1',
    description: 'Leading industry experts discuss the roadmap of Quantum Computing in education.',
    category: 'Seminar',
    imageUrl: 'https://picsum.photos/seed/tech/800/600',
  },
  {
    id: '4',
    title: 'Prototype Exhibition',
    date: new Date('2025-01-10T09:00:00'),
    location: 'Gallery Hall',
    description: 'Showcasing the best student projects from the Fall semester.',
    category: 'Exhibition',
    imageUrl: 'https://picsum.photos/seed/proto/800/600',
  }
];

export const PROJECTS: Project[] = [
  { 
    id: '1', 
    title: "Smart Irrigation Node", 
    category: "IoT", 
    image: "https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&q=80&w=800", 
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    description: "Automated water management using soil moisture sensors and cloud analytics.",
    longDescription: "This project addresses the water scarcity issue in agriculture by implementing a precision irrigation system. Utilizing LoRaWAN connectivity, the node communicates soil moisture data to a central gateway up to 5km away. The system autonomously controls solenoid valves to water crops only when necessary, saving up to 40% of water compared to traditional methods.",
    author: "Arjun K.",
    technologies: ["ESP32", "LoRaWAN", "AWS IoT Core", "React Native"],
    gallery: [
        "https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&q=80&w=800",
        "https://picsum.photos/seed/irrigation1/800/600",
        "https://picsum.photos/seed/irrigation2/800/600"
    ],
    date: "Sep 2024"
  },
  { 
    id: '2', 
    title: "Autonomous Drone", 
    category: "Robotics", 
    image: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&q=80&w=800", 
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    description: "AI-powered drone for agricultural surveillance and pest detection.",
    longDescription: "A custom-built quadcopter featuring onboard edge AI processing. The drone patrols designated field areas, capturing high-resolution imagery to detect early signs of pest infestation or nutrient deficiency. It uses a Jetson Nano for real-time inference and can cover 50 acres on a single charge.",
    author: "Team Aeros",
    technologies: ["Pixhawk", "Jetson Nano", "Computer Vision", "Python"],
    gallery: [
        "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&q=80&w=800",
        "https://picsum.photos/seed/drone1/800/600"
    ],
    date: "Aug 2024"
  },
  { 
    id: '3', 
    title: "EV Thermal BMS", 
    category: "Energy", 
    image: "https://images.unsplash.com/photo-1620288627223-53302f4e8c3a?auto=format&fit=crop&q=80&w=800", 
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    description: "High-efficiency BMS for electric 2-wheelers with active thermal regulation.",
    longDescription: "Safety is paramount in EV battery packs. This Battery Management System (BMS) integrates active liquid cooling control based on predictive thermal modeling. It monitors individual cell voltages and temperatures with high precision, ensuring optimal performance and longevity of Li-ion packs.",
    author: "Sarah J.",
    technologies: ["STM32", "Power Electronics", "MATLAB/Simulink", "Altium"],
    date: "Oct 2024"
  },
  { 
    id: '4', 
    title: "VR Education Kit", 
    category: "AR/VR", 
    image: "https://images.unsplash.com/photo-1622979135228-5b1ed37a4e6b?auto=format&fit=crop&q=80&w=800", 
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    description: "Immersive learning modules for mechanical engineering students.",
    longDescription: "Understanding complex internal combustion engines is made easy with this VR kit. Students can disassemble and reassemble engine components in a virtual environment, learning about tolerances and assembly procedures without the need for physical heavy machinery.",
    author: "Innovation Club",
    technologies: ["Unity 3D", "Oculus SDK", "C#", "Blender"],
    date: "July 2024"
  },
  { 
    id: '5', 
    title: "Bionic Prosthetic", 
    category: "Biomedical", 
    image: "https://images.unsplash.com/photo-1589254065878-42c9da997008?auto=format&fit=crop&q=80&w=800", 
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    description: "3D printed affordable prosthetic arm controlled by EMG signals.",
    longDescription: "A low-cost, open-source prosthetic arm designed for amputees in developing regions. The structural components are 3D printed using PLA/Nylon, and the control system uses non-invasive EMG sensors to detect muscle impulses, allowing the user to perform basic grip functions.",
    author: "MedTech Team",
    technologies: ["3D Printing", "EMG Sensors", "Arduino", "Signal Processing"],
    date: "Nov 2024"
  },
  { 
    id: '6', 
    title: "Eco-Waste Sorter", 
    category: "Sustainability", 
    image: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=800", 
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    description: "ML-based automatic waste classification bin for smart cities.",
    longDescription: "This smart bin uses a camera and a TensorFlow Lite model to classify waste into dry, wet, and hazardous categories automatically. It features a rotating flap mechanism to deposit waste into the correct internal compartment.",
    author: "Green Earth",
    technologies: ["Raspberry Pi", "TensorFlow Lite", "Mechanical Design", "Sustainability"],
    date: "Aug 2024"
  },
];

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: '1',
    type: 'video',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    poster: 'https://picsum.photos/seed/vid1/600/800',
    title: 'Laser Cutting Demo',
    size: 'large',
  },
  {
    id: '2',
    type: 'image',
    src: 'https://picsum.photos/seed/lab1/600/600',
    title: '3D Printing Lab',
    size: 'medium',
  },
  {
    id: '3',
    type: 'image',
    src: 'https://picsum.photos/seed/lab2/600/400',
    title: 'Student Collaboration',
    size: 'small',
  },
  {
    id: '4',
    type: 'video',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    poster: 'https://picsum.photos/seed/vid2/600/600',
    title: 'Drone Testing',
    size: 'medium',
  },
  {
    id: '5',
    type: 'image',
    src: 'https://picsum.photos/seed/lab3/600/800',
    title: 'Circuit Design',
    size: 'large',
  },
  {
    id: '6',
    type: 'image',
    src: 'https://picsum.photos/seed/lab4/600/400',
    title: 'Team Meeting',
    size: 'small',
  },
   {
    id: '7',
    type: 'video',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    poster: 'https://picsum.photos/seed/vid3/600/400',
    title: 'Animation Studio',
    size: 'medium',
  },
];

export const INDIAN_HOLIDAYS = [
    '2024-01-26', '2024-03-08', '2024-03-25', '2024-03-29', '2024-04-09', 
    '2024-04-11', '2024-04-14', '2024-04-17', '2024-05-01', '2024-06-17', 
    '2024-07-17', '2024-08-15', '2024-08-26', '2024-09-07', '2024-09-16', 
    '2024-10-02', '2024-10-12', '2024-10-31', '2024-11-01', '2024-12-25',
    '2025-01-14', '2025-01-26', '2025-02-26', '2025-03-14', '2025-03-31',
    '2025-04-06', '2025-04-10', '2025-04-14', '2025-04-18', '2025-05-01',
    '2025-06-07', '2025-07-06', '2025-08-15', '2025-08-16', '2025-08-27',
    '2025-09-05', '2025-10-02', '2025-10-02', '2025-10-20', '2025-11-01',
    '2025-12-25'
];
