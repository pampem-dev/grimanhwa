import React, { useEffect } from 'react';
import { ArrowLeft, Shield, Eye, Database, Lock, Mail, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const { darkMode } = useTheme();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#050505]' : 'bg-white'} text-white p-6`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-stone-100'}`}
          >
            <ArrowLeft size={24} className={darkMode ? 'text-white' : 'text-stone-900'} />
          </button>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        </div>

        {/* Last Updated */}
        <div className={`mb-8 text-sm ${darkMode ? 'text-gray-400' : 'text-stone-600'}`}>
          Last Updated: {new Date().toLocaleDateString()}
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Introduction</h2>
            <p className={`text-base leading-relaxed ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
              Welcome to grimanhwa. This is a personal project developed as a solo developer. I am committed to protecting your personal information and your right to privacy. This Privacy Policy explains how I collect, use, disclose, and safeguard your information when you use this manhwa reading application.
            </p>
          </section>

          {/* Information I Collect */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Database size={20} className="text-gray-400" />
              Information I Collect
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-white mb-2">Account Information</h3>
                <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
                  When you create an account, I collect your username, email address, and password. Your password is securely hashed and stored.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Reading Data</h3>
                <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
                  I collect information about your reading history, including manhwa titles you've read, chapters you've viewed, and your reading progress. This data is used to sync your reading experience across devices.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Library and Collections</h3>
                <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
                  I store your personal library and collections, which are manhwa you've saved for easy access.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Application Settings</h3>
                <p className={`text-base ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
                  I store your app preferences, such as theme settings (dark/light mode), reading mode preferences, and other customization options.
                </p>
              </div>
            </div>
          </section>

          {/* How I Use Your Information */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Eye size={20} className="text-gray-400" />
              How I Use Your Information
            </h2>
            <ul className={`list-disc list-inside space-y-2 ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
              <li>To provide and maintain the manhwa reading service</li>
              <li>To sync your reading data across multiple devices</li>
              <li>To personalize your reading experience</li>
              <li>To improve the application and develop new features</li>
              <li>To communicate with you about your account and service updates</li>
            </ul>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Lock size={20} className="text-gray-400" />
              Data Security
            </h2>
            <p className={`text-base leading-relaxed ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
              I implement appropriate technical measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption of sensitive data and secure authentication mechanisms.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Data Retention</h2>
            <p className={`text-base leading-relaxed ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
              I retain your personal information for as long as necessary to provide the service and fulfill the purposes outlined in this Privacy Policy. You may request deletion of your account and associated data at any time through the settings menu or by contacting me.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield size={20} className="text-gray-400" />
              Your Rights
            </h2>
            <p className={`text-base leading-relaxed mb-4 ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
              You have the following rights regarding your personal information:
            </p>
            <ul className={`list-disc list-inside space-y-2 ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
              <li>Access to your personal information</li>
              <li>Correction of inaccurate information</li>
              <li>Deletion of your personal information</li>
              <li>Opt-out of certain data processing activities</li>
              <li>Data portability</li>
            </ul>
          </section>

          {/* Data Sources */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Data Sources</h2>
            <p className={`text-base leading-relaxed ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
              Manhwa content is fetched from publicly available sources on the internet. This application does not store manhwa content on its servers - it only serves as a reader interface. The original content sources have their own terms of service and policies.
            </p>
          </section>

          {/* Changes to This Policy */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Changes to This Privacy Policy</h2>
            <p className={`text-base leading-relaxed ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
              I may update this Privacy Policy from time to time. I will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
            </p>
          </section>

          {/* Contact Us */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Mail size={20} className="text-gray-400" />
              Contact Me
            </h2>
            <p className={`text-base leading-relaxed ${darkMode ? 'text-gray-300' : 'text-stone-700'}`}>
              If you have any questions about this Privacy Policy, please contact me through the GitHub repository or by opening an issue.
            </p>
            <a
              href="https://github.com/pampem-dev/grimanhwa"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink size={16} />
              Visit on GitHub
            </a>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
