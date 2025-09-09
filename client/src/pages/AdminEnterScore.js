import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { competitionsAPI, scoresAPI } from '../services/api';
import { Target, Users, Save, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminEnterScore = () => {
  const queryClient = useQueryClient();
  const [competitionId, setCompetitionId] = useState('');
  const [competitorId, setCompetitorId] = useState('');
  const [shotScores, setShotScores] = useState(Array(10).fill({ value: '', isX: false }));
  const [photoUrl, setPhotoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Load competitions (published/active preferred)
  const { data: competitionsResp } = useQuery(
    ['admin-enter-score-competitions'],
    () => competitionsAPI.getAll().then(r => r.data),
    { staleTime: 5 * 60 * 1000 }
  );

  const competitions = (competitionsResp?.competitions || []).filter(c => c.status === 'published' || c.status === 'active');

  // Load selected competition for participants and required shots
  const { data: selectedComp } = useQuery(
    ['competition', competitionId],
    () => competitionId ? competitionsAPI.getById(competitionId).then(r => r.data?.competition) : null,
    { enabled: !!competitionId, staleTime: 2 * 60 * 1000 }
  );

  const participants = useMemo(() => selectedComp?.participants || [], [selectedComp]);

  useEffect(() => {
    // Reset competitor when competition changes
    setCompetitorId('');
    const required = selectedComp?.shotsPerTarget || 10;
    if (required && shotScores.length !== required) {
      setShotScores(Array(required).fill({ value: '', isX: false }));
    }
  }, [competitionId, selectedComp]);

  const setShotValue = (index, value) => {
    const next = [...shotScores];
    const intVal = value === '' ? '' : Math.max(0, Math.min(10, parseInt(value, 10) || 0));
    next[index] = { value: intVal, isX: intVal === 10 ? (next[index]?.isX || false) : false };
    setShotScores(next);
  };

  const toggleX = (index, checked) => {
    const next = [...shotScores];
    const current = next[index] || { value: '', isX: false };
    next[index] = checked ? { value: 10, isX: true } : { value: current.value, isX: false };
    setShotScores(next);
  };

  const totalScore = useMemo(() => shotScores.reduce((t, s) => t + (parseInt(s.value, 10) || 0), 0), [shotScores]);
  const xCount = useMemo(() => shotScores.filter(s => parseInt(s.value, 10) === 10 && s.isX).length, [shotScores]);

  const mutation = useMutation(
    (payload) => scoresAPI.submitOnBehalf(payload),
    {
      onSuccess: () => {
        toast.success('Score submitted on behalf of competitor');
        queryClient.invalidateQueries(['competition-scores', competitionId]);
        setShotScores(Array(selectedComp?.shotsPerTarget || 10).fill({ value: '', isX: false }));
        setPhotoUrl('');
        setVideoUrl('');
        setCompetitorId('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to submit score');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!competitionId) return toast.error('Choose a competition');
    if (!competitorId) return toast.error('Choose a competitor');
    const required = selectedComp?.shotsPerTarget || 10;
    const filled = shotScores.filter(s => s.value !== '' && s.value !== null && s.value !== undefined);
    if (filled.length !== required) {
      return toast.error(`This competition requires ${required} shots. You entered ${filled.length}.`);
    }

    const shots = shotScores.map(s => ({ value: parseInt((s?.value ?? '0'), 10) || 0, isX: s?.isX === true })).slice(0, required);
    const payload = {
      competitionId,
      competitorId,
      score: Math.round(totalScore),
      shots,
      evidence: {
        ...(photoUrl ? { photoUrl } : {}),
        ...(videoUrl ? { videoUrl } : {}),
      },
    };
    mutation.mutate(payload);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enter Score (Admin)</h1>
          <p className="text-gray-600">Submit a score for a registered competitor. Submissions are auto-approved.</p>
        </div>
        <CheckCircle className="w-8 h-8 text-green-500" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Competition</label>
              <select
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select competition...</option>
                {competitions.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.schedule?.competitionDate ? `— ${new Date(c.schedule.competitionDate).toLocaleDateString()}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-1" /> Competitor (registered)
              </label>
              <select
                value={competitorId}
                onChange={(e) => setCompetitorId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={!competitionId}
              >
                <option value="">Select competitor...</option>
                {participants.map((p) => (
                  <option key={p.userId} value={p.userId}>{p.userName || p.username || p.userId}</option>
                ))}
              </select>
              {!competitionId && (
                <p className="text-xs text-gray-500 mt-1">Choose a competition to see registered participants.</p>
              )}
              {competitionId && participants.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">No registered participants found for this competition.</p>
              )}
            </div>
          </div>
        </div>

        {/* Shot Entry */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2" /> Shots — required: {selectedComp?.shotsPerTarget || 10}
          </h2>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-3 mb-4">
            {shotScores.map((shot, index) => (
              <div key={index} className="text-center">
                <label className="block text-xs font-medium text-gray-700 mb-1">Shot {index + 1}</label>
                <div className="flex items-center gap-2 justify-center">
                  <select
                    value={shot.value}
                    onChange={(e) => setShotValue(index, e.target.value)}
                    className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">--</option>
                    {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={!!shot.isX}
                      onChange={(e) => toggleX(index, e.target.checked)}
                    />
                    <span>X</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total Score:</span>
              <span className="text-2xl font-bold text-blue-600">{totalScore} ({xCount}X)</span>
            </div>
          </div>
        </div>

        {/* Evidence (optional) */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Photo URL (optional)</label>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/target.jpg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Video URL (optional)</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/video.mp4"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={mutation.isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {mutation.isLoading ? 'Submitting...' : (<><Save className="w-4 h-4 mr-2" /> Submit Score</>)}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminEnterScore;

