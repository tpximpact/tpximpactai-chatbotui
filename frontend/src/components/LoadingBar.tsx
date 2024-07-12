import React, { useState, useEffect } from 'react';
import COLOURS from '../constants/COLOURS';

const LoadingBar: React.FC<{ progress: number }> = ({ progress }) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const progressBarAnimation = setInterval(() => {
      setWidth((prevWidth) => {
        const diff = progress - prevWidth;
        const step = diff / 10; // Adjust the step for smoother animation
        return prevWidth + step;
      });
    }, 100);

    // Cleanup function to clear the interval
    return () => clearInterval(progressBarAnimation);
  }, [progress]);

  return (
    <div style={{ width: '100%', height: '20px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
      <div className="loading-bar" style={{ height: '100%', backgroundColor: COLOURS.blue, width: `${width * 100}%`, transition: 'width 0.5s ease' }}></div>
    </div>
  );
};

export default LoadingBar;
