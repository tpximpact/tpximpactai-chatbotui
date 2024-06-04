import React from 'react';

interface LoadingProps {
  size?: number; // Optional prop for specifying the size of the spinner
  color?: string; // Optional prop for specifying the color of the spinner
}

const Loading: React.FC<LoadingProps> = ({ size = 50, color = '#007bff' }) => {
  const spinnerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    border: `3px solid ${color}`,
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    textAlign: 'center',
    alignSelf: 'center',
    display:'block',
    alignContent:'center',
    justifyContent:'center',
  };

  const keyframes = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>
      <div style={spinnerStyle} />
    </>
  );
};

export default Loading;
