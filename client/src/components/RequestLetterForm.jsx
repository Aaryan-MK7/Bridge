import React, { useState } from "react";

const letterFields = {
  "Certificate Reimbursement": [
    { name: "courseName", label: "Course Name", type: "text" },
    { name: "amount", label: "Reimbursement Amount", type: "number" },
    { name: "institute", label: "Institute Name", type: "text" },
  ],
  "HR Address Proof": [
    { name: "address", label: "Current Address", type: "text" },
    { name: "duration", label: "Duration of Stay", type: "text" },
  ],
  "Internship Completion": [
    { name: "internshipRole", label: "Internship Role", type: "text" },
    { name: "startDate", label: "Start Date", type: "date" },
    { name: "endDate", label: "End Date", type: "date" },
  ],
  "NOC": [
    { name: "purpose", label: "Purpose", type: "text" },
    { name: "destination", label: "Travel Destination", type: "text" },
  ],
  "Relieving Letter": [
    { name: "lastWorkingDay", label: "Last Working Day", type: "date" },
    { name: "reason", label: "Reason for Leaving", type: "text" },
  ],
  "VISA Letter": [
    { name: "country", label: "Country", type: "text" },
    { name: "duration", label: "Stay Duration", type: "text" },
    { name: "purpose", label: "Purpose of Visit", type: "text" },
  ],
  "Offer Letter": [
    { name: "position", label: "Position Offered", type: "text" },
    { name: "joiningDate", label: "Joining Date", type: "date" },
    { name: "salary", label: "Offered Salary", type: "number" },
  ],
};

export default function RequestLetterForm() {
  const [letterType, setLetterType] = useState("");
  const [formData, setFormData] = useState({});

  const handleTypeChange = (e) => {
    setLetterType(e.target.value);
    setFormData({}); // Reset form when letter type changes
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Submitting Letter Request:", { letterType, ...formData });
    alert("Request submitted (frontend only). Check console log.");
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
      <h2 className="text-xl font-semibold mb-4">Request a Letter</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Letter Type Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Letter Type</label>
          <select
            value={letterType}
            onChange={handleTypeChange}
            className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="" disabled>Select a letter type</option>
            {Object.keys(letterFields).map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Dynamic Fields */}
        {letterFields[letterType]?.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
            <input
              type={field.type}
              name={field.name}
              value={formData[field.name] || ""}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        ))}

        {/* Submit */}
        {letterType && (
          <button
            type="submit"
            className="mt-4 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition"
          >
            Submit Request
          </button>
        )}
      </form>
    </div>
  );
}
