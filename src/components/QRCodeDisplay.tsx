import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ value, size = 200, className = '' }) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error('QR Code error:', err));
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`max-w-full aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse ${className}`}
      >
        <span className="text-xs text-gray-400">Generating QR...</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Pairing QR Code"
      width={size}
      height={size}
      className={`max-w-full h-auto rounded-xl shadow-md border border-gray-200 dark:border-gray-700 ${className}`}
    />
  );
};
