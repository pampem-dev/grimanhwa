import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-[#0a0a0a] border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="text-center text-xs text-gray-500">
          © {new Date().getFullYear()} grimanhwa
        </div>
      </div>
    </footer>
  );
};

export default Footer;
