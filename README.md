# CS559 Project 3 - 3D Graphics Scene

A 3D graphics project built with Three.js for CS559 (Computer Graphics).

## Features

- Interactive 3D scene with multiple geometric objects
- Orbit controls for camera manipulation
- Dynamic lighting with shadows
- Animated objects (rotating cube, sphere, cone, and torus)
- Responsive design

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Project

To start the development server:
```bash
npm run dev
```

The application will open at `http://localhost:5173` (or another port if 5173 is busy).

### Building for Production

To build the project:
```bash
npm run build
```

The built files will be in the `dist/` directory.

## Controls

- **Mouse drag**: Rotate the camera around the scene
- **Mouse wheel**: Zoom in/out
- **Right-click drag**: Pan the camera

## Project Structure

```
cs559-p3-thing/
├── src/
│   └── main.js          # Main Three.js scene setup and animation
├── index.html           # HTML entry point
├── package.json         # Project dependencies and scripts
└── README.md           # This file
```

## Technologies Used

- [Three.js](https://threejs.org/) - 3D graphics library
- [Vite](https://vitejs.dev/) - Build tool and dev server
