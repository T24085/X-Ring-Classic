import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { scoresAPI } from '../services/api.firebase';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Target, 
  User, 
  Trophy,
  Eye,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

const ScoreVerification = () => {
  const [selectedScore, setSelectedScore] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: pendingScores, isLoading, error } = useQuery(
    'pending-verification',
    scoresAPI.getPendingVerification,
    {
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: 30 * 1000 // Auto-refresh every 30 seconds
    }
  );

  const verifyMutation = useMutation(
    ({ scoreId, status, notes }) => scoresAPI.verify(scoreId, status, notes),
    {
      onSuccess: (data, variables) => {
        toast.success(`Score ${variables.status} successfully`);
        queryClient.invalidateQueries('pending-verification');
        setSelectedScore(null);
        setVerificationNotes('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to verify score');
      }
    }
  );

  const handleVerify = (scoreId, status) => {
    verifyMutation.mutate({
      scoreId,
      status,
      notes: verificationNotes
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'flagged':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">Error loading pending scores</div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const scores = pendingScores?.scores || [];
  const getCompetitorName = (score) => {
    const firstName = score?.competitor?.firstName;
    const lastName = score?.competitor?.lastName;
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    if (score?.competitor?.username) return score.competitor.username;
    return score?.competitorId || 'Unknown competitor';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">Score Verification</h1>
        <p className="text-xl text-white max-w-3xl mx-auto drop-shadow-md">
          Review and verify pending score submissions from competitors
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{scores.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Scores */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Pending Verifications</h2>
        </div>
        
        {scores.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-700">No pending scores to verify</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {scores.map((score) => (
              <div key={score.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(score.verificationStatus)}
                        <span className="text-sm font-medium text-gray-900">
                          {getCompetitorName(score)}
                        </span>
                        {score.competitor?.username && (
                          <span className="text-sm text-gray-700">(@{score.competitor.username})</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Trophy className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">
                          {score.competition?.title}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-700">Score</p>
                        <p className="text-2xl font-bold text-gray-900">{score.score}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">Perfect Shots</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {score.tiebreakerData?.perfectShots || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">Submitted</p>
                        <p className="text-sm text-gray-900">
                          {new Date(score.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {score.evidence && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Evidence:</p>
                        <div className="flex space-x-4">
                          {score.evidence.photoUrl && (
                            <a 
                              href={score.evidence.photoUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                            >
                              <Eye className="w-4 h-4" />
                              <span>View Photo</span>
                            </a>
                          )}
                          {score.evidence.videoUrl && (
                            <a 
                              href={score.evidence.videoUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                            >
                              <Eye className="w-4 h-4" />
                              <span>View Video</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {score.notes && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                        <p className="text-sm text-gray-700">{score.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="ml-6 flex flex-col space-y-2">
                    <button
                      onClick={() => setSelectedScore(score)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Review Details
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex space-x-3 mt-4">
                  <button
                    onClick={() => handleVerify(score.id, 'approved')}
                    disabled={verifyMutation.isLoading}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleVerify(score.id, 'rejected')}
                    disabled={verifyMutation.isLoading}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verification Modal */}
      {selectedScore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Review Score</h2>
                <button
                  onClick={() => setSelectedScore(null)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Score Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-700">Competitor</p>
                      <p className="font-medium">{getCompetitorName(selectedScore)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-700">Competition</p>
                      <p className="font-medium">{selectedScore.competition?.title}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Score</p>
                      <p className="text-2xl font-bold">{selectedScore.score}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Perfect Shots</p>
                      <p className="font-medium">{selectedScore.tiebreakerData?.perfectShots || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">X Count</p>
                      <p className="font-medium">{selectedScore.tiebreakerData?.xCount || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Shots */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Shot Details</h3>
                  <div className="grid grid-cols-10 gap-2">
                    {selectedScore.shots?.map((shot, index) => (
                      <div key={index} className="text-center">
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${shot.isX ? 'border-blue-500 text-blue-600' : 'border-gray-300'}`}>
                          {shot.isX ? 'X' : shot.value}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Shot {index + 1}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidence */}
                {selectedScore.evidence && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Evidence</h3>
                    <div className="space-y-4">
                      {selectedScore.evidence.photoUrl && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Photo:</p>
                          <a 
                            href={selectedScore.evidence.photoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            View Photo
                          </a>
                        </div>
                      )}
                      {selectedScore.evidence.videoUrl && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Video:</p>
                          <a 
                            href={selectedScore.evidence.videoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            View Video
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Verification Notes */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Notes</h3>
                  <textarea
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Add notes about your verification decision..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setSelectedScore(null)}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleVerify(selectedScore.id, 'rejected')}
                    disabled={verifyMutation.isLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleVerify(selectedScore.id, 'approved')}
                    disabled={verifyMutation.isLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreVerification;
