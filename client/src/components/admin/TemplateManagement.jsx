
// /src/components/admin/TemplateManagement.jsx
import React, { useState } from "react";

export default function TemplateManagement() {
  const [templates, setTemplates] = useState([
    { id: 1, name: "Offer Letter", type: "Offer", content: "Welcome to the company..." },
    { id: 2, name: "Relieving Letter", type: "Exit", content: "This letter is to confirm..." },
  ]);
  const [newTemplate, setNewTemplate] = useState({ name: "", type: "", content: "" });
  const [editingId, setEditingId] = useState(null);

  const handleInputChange = (e) => {
    setNewTemplate({ ...newTemplate, [e.target.name]: e.target.value });
  };

  const handleCreateTemplate = () => {
    const newId = templates.length + 1;
    setTemplates([...templates, { id: newId, ...newTemplate }]);
    setNewTemplate({ name: "", type: "", content: "" });
  };

  const handleDelete = (id) => {
    setTemplates(templates.filter((template) => template.id !== id));
  };

  const handleEdit = (id) => {
    const template = templates.find((t) => t.id === id);
    setNewTemplate(template);
    setEditingId(id);
  };

  const handleUpdate = () => {
    setTemplates(
      templates.map((template) =>
        template.id === editingId ? { ...template, ...newTemplate } : template
      )
    );
    setNewTemplate({ name: "", type: "", content: "" });
    setEditingId(null);
  };

  return (
    <div className="p-4 bg-white shadow rounded">
      <h2 className="text-xl font-semibold mb-4">📄 Template Management</h2>

      <div className="space-y-4">
        <div className="grid gap-2">
          <input
            name="name"
            value={newTemplate.name}
            onChange={handleInputChange}
            className="p-2 border rounded"
            placeholder="Template Name"
          />
          <input
            name="type"
            value={newTemplate.type}
            onChange={handleInputChange}
            className="p-2 border rounded"
            placeholder="Template Type"
          />
          <textarea
            name="content"
            value={newTemplate.content}
            onChange={handleInputChange}
            className="p-2 border rounded"
            placeholder="Template Content"
            rows={4}
          />
          {editingId ? (
            <button
              onClick={handleUpdate}
              className="px-4 py-2 bg-yellow-500 text-white rounded"
            >
              Update Template
            </button>
          ) : (
            <button
              onClick={handleCreateTemplate}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Add Template
            </button>
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">📑 Existing Templates</h3>
          {templates.length === 0 ? (
            <p>No templates available.</p>
          ) : (
            <ul className="space-y-2">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="border p-4 rounded flex justify-between items-start"
                >
                  <div>
                    <p className="font-semibold">{template.name}</p>
                    <p className="text-sm text-gray-600">{template.type}</p>
                    <p className="text-sm mt-1">{template.content.slice(0, 100)}...</p>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => handleEdit(template.id)}
                      className="text-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
