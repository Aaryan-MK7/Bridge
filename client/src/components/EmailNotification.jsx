import React, { useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import { API_URL } from "../config/api";

export default function EmailNotification() {
  const form = useRef();
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // EmailJS configuration - these should be in your environment variables
  const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || "YOUR_SERVICE_ID";
  const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "YOUR_TEMPLATE_ID";
  const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "YOUR_PUBLIC_KEY";

  const sendEmail = (e) => {
    e.preventDefault();
    setSending(true);
    setStatus({ type: '', message: '' });

    emailjs
      .sendForm(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        form.current,
        EMAILJS_PUBLIC_KEY
      )
      .then(
        (result) => {
          console.log("Email sent successfully:", result.text);
          setStatus({ type: 'success', message: 'Message sent successfully!' });
          form.current.reset();
        },
        (error) => {
          console.error("Email sending failed:", error.text);
          setStatus({ type: 'error', message: 'Failed to send message. Please try again.' });
        }
      )
      .finally(() => {
        setSending(false);
      });
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        Contact HR Department
      </h2>

      <form ref={form} onSubmit={sendEmail} className="space-y-4">
        <div>
          <label htmlFor="user_name" className="block text-sm font-medium text-gray-700 mb-1">
            Your Name
          </label>
          <input
            type="text"
            name="user_name"
            id="user_name"
            placeholder="Enter your full name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label htmlFor="user_email" className="block text-sm font-medium text-gray-700 mb-1">
            Your Email
          </label>
          <input
            type="email"
            name="user_email"
            id="user_email"
            placeholder="Enter your email address"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
            Subject
          </label>
          <input
            type="text"
            name="subject"
            id="subject"
            placeholder="Enter subject of your message"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            name="message"
            id="message"
            rows="4"
            placeholder="Enter your message here..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            required
          />
        </div>

        <button
          type="submit"
          disabled={sending}
          className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
            sending
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          } text-white`}
        >
          {sending ? 'Sending...' : 'Send Message'}
        </button>

        {/* Test EmailJS Configuration Button */}
        <button
          type="button"
          onClick={async () => {
            try {
              const response = await fetch(`${API_URL}/api/letter-requests/test-email`);
              const result = await response.json();

              if (result.success) {
                setStatus({ type: 'success', message: 'Test email sent successfully! Check your admin email.' });
              } else {
                setStatus({ type: 'error', message: result.error || 'Test failed' });
              }
            } catch (error) {
              setStatus({ type: 'error', message: 'Failed to test email configuration' });
            }
          }}
          className="w-full py-2 px-4 rounded-md font-medium bg-green-600 hover:bg-green-700 active:bg-green-800 text-white transition-colors"
        >
          Test EmailJS Configuration
        </button>
      </form>

      {/* Status Messages */}
      {status.message && (
        <div className={`mt-4 p-3 rounded-md ${
          status.type === 'success'
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {status.message}
        </div>
      )}

      {/* Configuration Status */}
      <div className="mt-6 p-3 bg-gray-100 rounded-md">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Email Configuration Status:</h3>
        <div className="space-y-1 text-xs text-gray-600">
          <div>Service ID: {EMAILJS_SERVICE_ID !== "YOUR_SERVICE_ID" ? '✅ Configured' : '❌ Not Configured'}</div>
          <div>Template ID: {EMAILJS_TEMPLATE_ID !== "YOUR_TEMPLATE_ID" ? '✅ Configured' : '❌ Not Configured'}</div>
          <div>Public Key: {EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY" ? '✅ Configured' : '❌ Not Configured'}</div>
        </div>
        {EMAILJS_SERVICE_ID === "YOUR_SERVICE_ID" && (
          <p className="text-xs text-red-600 mt-2">
            Please configure EmailJS environment variables to enable email functionality.
          </p>
        )}
      </div>
    </div>
  );
}
