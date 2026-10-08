import { API_URL } from "../config/api";
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ForgotPassword() {
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetLink, setResetLink] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setResetLink('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/employees/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId,
          email,
        }),
      });

      const data = await response.json();
      setIsLoading(false);

      if (data.success) {
        setSuccess(data.message);
        if (data.resetLink) {
          setResetLink(data.resetLink);
        }
      } else {
        setError(data.message || 'Failed to process request');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Network error. Please try again.');
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left Half */}
      <div
        className="hidden md:flex md:w-1/2 items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #171D34 0%, #9546F6 100%)",
        }}
      >
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">Forgot Password?</h1>
          <p className="text-xl opacity-90">Don't worry, we'll help you reset it.</p>
        </div>
      </div>

      {/* Right Half - Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center relative bg-white bg-opacity-5 backdrop-blur-2xl">
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>

        {/* Form Content */}
        <div className="relative z-10 w-full max-w-md p-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#171d34] mb-2">Reset Password</h1>
            <p className="text-[#171d34] text-opacity-80">
              Enter your Employee ID and email to receive a password reset link.
            </p>
          </div>

          <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white border-opacity-20">
            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Employee ID */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-[#9546F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Employee ID"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-xl text-[#171d34] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9546F6] focus:border-transparent backdrop-blur-sm transition-all duration-300"
                    required
                  />
                </div>

                {/* Email */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-[#9546F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-xl text-[#171d34] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9546F6] focus:border-transparent backdrop-blur-sm transition-all duration-300"
                    required
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="px-4 py-2 rounded bg-red-50 text-red-700 border border-red-200">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#9546F6] hover:bg-[#7b35c3] disabled:bg-opacity-30 text-white font-semibold py-4 rounded-xl transition-all duration-300 shadow-lg flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Back to Login */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="text-[#9546F6] hover:text-[#7b35c3] text-sm font-medium transition-colors"
                  >
                    ← Back to Login
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                {/* Success Message */}
                <div className="px-4 py-3 rounded bg-green-50 text-green-700 border border-green-200">
                  <p className="font-medium">{success}</p>
                  {resetLink && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-800 mb-2">
                        <strong>Note:</strong> {resetLink ? 'In production, this link would be sent via email.' : ''}
                      </p>
                      {resetLink && (
                        <div>
                          <p className="text-sm text-blue-700 mb-2">For testing purposes, here's your reset link:</p>
                          <a
                            href={resetLink}
                            className="text-blue-600 hover:text-blue-800 text-sm break-all underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {resetLink}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Back to Login Button */}
                <button
                  onClick={handleBackToLogin}
                  className="w-full bg-[#9546F6] hover:bg-[#7b35c3] text-white font-semibold py-4 rounded-xl transition-all duration-300 shadow-lg"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
