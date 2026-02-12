import React from 'react';

export const LoadingSkeleton = ({ rows = 5, className = '' }) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="mb-3">
          <div className="h-4 bg-gray-200 rounded" style={{ width: `${Math.random() * 40 + 60}%` }}></div>
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-6 bg-gray-300 rounded w-1/4"></div>
      <table className="w-full">
        <thead>
          <tr>
            {[...Array(cols)].map((_, i) => (
              <th key={i} className="p-2">
                <div className="h-4 bg-gray-200 rounded"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <tr key={i}>
              {[...Array(cols)].map((_, j) => (
                <td key={j} className="p-2">
                  <div className="h-4 bg-gray-100 rounded"></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const ChartSkeleton = () => {
  return (
    <div className="animate-pulse">
      <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
      <div className="h-64 bg-gray-100 rounded flex items-end gap-2 p-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-300 rounded"
            style={{ height: `${Math.random() * 60 + 40}%` }}
          ></div>
        ))}
      </div>
    </div>
  );
};
