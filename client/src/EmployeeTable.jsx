import { API_URL } from "./config/api";
import React, { useEffect, useState } from "react";

export default function EmployeeTable() {
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/employees`)
      .then((res) => res.json())
      .then((data) => setEmployees(data))
      .catch((err) => console.error("Error fetching employees:", err));
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Employee List</h2>
      <table border="1" cellPadding="10" style={{ width: "100%", marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Start Date</th>
            <th>Title</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp._id}>
              <td>{emp.employeeId}</td>
              <td>{emp.name}</td>
              <td>{emp.startDate}</td>
              <td>{emp.title}</td>
              <td>{emp.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
