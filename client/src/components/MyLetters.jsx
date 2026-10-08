import React from "react";

const mockLetters = [
  {
    id: 1,
    type: "NOC",
    status: "pending",
    submittedAt: "2025-07-13",
  },
  {
    id: 2,
    type: "HR Address Proof",
    status: "approved",
    submittedAt: "2025-07-10",
  },
  {
    id: 3,
    type: "Internship Completion",
    status: "rejected",
    submittedAt: "2025-07-05",
  },
];

const statusColor = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-700",
};

export default function MyLetters() {
  return (
    <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
      <h2 className="text-xl font-semibold mb-4">My Letters</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border divide-y divide-gray-200">
          <thead className="bg-gray-50 text-left text-sm font-semibold text-gray-700">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Letter Type</th>
              <th className="px-4 py-2">Submitted On</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100 text-sm">
            {mockLetters.map((letter, index) => (
              <tr key={letter.id}>
                <td className="px-4 py-3">{index + 1}</td>
                <td className="px-4 py-3">{letter.type}</td>
                <td className="px-4 py-3">{letter.submittedAt}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[letter.status]}`}>
                    {letter.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button className="bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-50 font-medium px-4 py-2 rounded-lg transition duration-200 text-sm">
                    Preview
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
