import React from 'react';
import { useQuery } from 'react-query';
import { competitionsAPI, leaderboardsAPI } from '../services/api';

const TestPage = () => {
  const { data: competitions, isLoading: compLoading, error: compError } = useQuery(
    'test-competitions',
    async () => {
      console.log('Testing competitions API...');
      const response = await competitionsAPI.getAll({ status: 'published', limit: 3 });
      console.log('Competitions API response:', response);
      return response;
    }
  );

  const { data: leaderboard, isLoading: lbLoading, error: lbError } = useQuery(
    'test-leaderboard',
    async () => {
      console.log('Testing leaderboard API...');
      const response = await leaderboardsAPI.getOverall({ limit: 5 });
      console.log('Leaderboard API response:', response);
      return response;
    }
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">API Test Page</h1>
      
      {/* Competitions Test */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Competitions API Test</h2>
        <div className="mb-4">
          <p><strong>Loading:</strong> {compLoading ? 'Yes' : 'No'}</p>
          <p><strong>Error:</strong> {compError ? compError.message : 'None'}</p>
        </div>
        <div className="bg-gray-100 p-4 rounded">
          <pre className="text-sm overflow-auto">
            {JSON.stringify(competitions, null, 2)}
          </pre>
        </div>
      </div>

      {/* Leaderboard Test */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Leaderboard API Test</h2>
        <div className="mb-4">
          <p><strong>Loading:</strong> {lbLoading ? 'Yes' : 'No'}</p>
          <p><strong>Error:</strong> {lbError ? lbError.message : 'None'}</p>
        </div>
        <div className="bg-gray-100 p-4 rounded">
          <pre className="text-sm overflow-auto">
            {JSON.stringify(leaderboard, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default TestPage;
