import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { competitionsAPI, scoresAPI, usersAPI } from '../services/api.firebase';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { Target, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const ScoreSubmission = () => {
  const { competitionId } = useParams();
  const { user } = useAuth();
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [shotScores, setShotScores] = useState(Array(10).fill({ value: '', isX: false }));
  const [reportMode, setReportMode] = useState('simple'); // 'simple' | 'advanced'
  const [cardCount, setCardCount] = useState(4);
  const [cards, setCards] = useState(() => Array.from({ length: 4 }, () => ({ score: '', xCount: '' })));
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm();

  // Fetch competitions for dropdown
  // Load competitions list (we'll filter client-side)
  const { data: competitions } = useQuery(
    'competitions',
    async () => {
      const resp = await competitionsAPI.getAll();
      return resp.data;
    },
    { staleTime: 5 * 60 * 1000 }
  );

  // Load user registered competitions to restrict to eligible events
  const { data: userComps } = useQuery(
    ['user-competitions', user?.id],
    async () => {
      if (!user?.id) return null;
      const resp = await usersAPI.getCompetitions(user.id);
      return resp.data;
    },
    { enabled: !!user?.id, staleTime: 2 * 60 * 1000 }
  );

  useEffect(() => {
    if (competitionId) {
      setSelectedCompetition(competitionId);
    }
  }, [competitionId]);

  const availableCompetitions = ((userComps?.registered && userComps.registered.length > 0)
    ? userComps.registered
    : (competitions?.competitions || [])
  ).filter((comp) => !['draft', 'cancelled', 'archived'].includes(comp.status));

  useEffect(() => {
    if (!selectedCompetition && availableCompetitions.length === 1) {
      setSelectedCompetition(availableCompetitions[0].id);
    }
  }, [availableCompetitions, selectedCompetition]);

  // Load selected competition details to determine required shots
  const { data: selectedComp } = useQuery(
    ['competition', selectedCompetition],
    async () => {
      if (!selectedCompetition) return null;
      const resp = await competitionsAPI.getById(selectedCompetition);
      return resp.data?.competition || null;
    },
    { enabled: !!selectedCompetition, staleTime: 2 * 60 * 1000 }
  );

  // Sync shot count with competition requirement
  useEffect(() => {
    const required = selectedComp?.shotsPerTarget || 10;
    if (required && shotScores.length !== required) {
      setShotScores(Array(required).fill({ value: '', isX: false }));
    }
  }, [selectedComp]);

  // Auto-populate competition date when a competition is selected/loaded
  useEffect(() => {
    const rawDate = selectedComp?.schedule?.competitionDate || selectedComp?.startDate;

    const toInputDate = (d) => {
      if (!d) return '';
      try {
        let ms;
        if (typeof d === 'object' && d.seconds) {
          ms = d.seconds * 1000; // Firestore Timestamp
        } else if (typeof d === 'number') {
          ms = d;
        } else {
          ms = Date.parse(d);
        }
        if (Number.isNaN(ms)) return '';
        const dt = new Date(ms);
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      } catch (_) {
        return '';
      }
    };

    const inputDate = toInputDate(rawDate);
    setValue('competitionDate', inputDate);
  }, [selectedComp, setValue]);

  // Score submission mutation
  const submitScoreMutation = useMutation(
    async (payload) => {
      if (Array.isArray(payload)) {
        return await Promise.all(payload.map((p) => scoresAPI.submit(p)));
      }
      return await scoresAPI.submit(payload);
    },
    {
      onSuccess: () => {
        toast.success('Score submitted successfully!');
        reset();
        const required = selectedComp?.shotsPerTarget || 10;
        setShotScores(Array(required).fill({ value: '', isX: false }));
        setCards(Array.from({ length: 4 }, () => ({ score: '', xCount: '' })));
        setCardCount(4);
        queryClient.invalidateQueries(['competition-scores', selectedCompetition]);
        queryClient.invalidateQueries('scores');
      },
      onError: (error) => {
        toast.error(error?.message || 'Failed to submit score');
      },
    }
  );

  const handleShotValueChange = (index, value) => {
    const newScores = [...shotScores];
    const intVal = value === '' ? '' : Math.max(0, Math.min(10, parseInt(value, 10) || 0));
    newScores[index] = { value: intVal, isX: intVal === 10 ? newScores[index]?.isX || false : false };
    setShotScores(newScores);
  };

  const handleShotXToggle = (index, checked) => {
    const newScores = [...shotScores];
    const current = newScores[index] || { value: '', isX: false };
    if (checked) {
      // Selecting X should automatically set value to 10
      newScores[index] = { value: 10, isX: true };
    } else {
      newScores[index] = { value: current.value, isX: false };
    }
    setShotScores(newScores);
  };

  const calculateTotalScore = () => {
    return shotScores.reduce((total, shot) => total + (parseInt(shot.value, 10) || 0), 0);
  };

  const calculateXCount = () => {
    return shotScores.filter((s) => parseInt(s.value, 10) === 10 && s.isX).length;
  };

  const simpleTotals = useMemo(() => {
    const active = cards.slice(0, cardCount);
    const totalScore = active.reduce((sum, c) => sum + (parseFloat(c.score) || 0), 0);
    const totalX = active.reduce((sum, c) => sum + (parseInt(c.xCount, 10) || 0), 0);
    return { totalScore, totalX };
  }, [cards, cardCount]);

  const updateCardField = (idx, field, value) => {
    setCards((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const onSubmit = (data) => {
    if (!selectedCompetition) {
      toast.error('Please select a competition');
      return;
    }

    if (!data.category) {
      toast.error('Please select a category (22LR or Airgun 22cal)');
      return;
    }

    if (reportMode === 'simple') {
      // Simple mode: submit up to 4 scorecards at once (each max 250 + 25X)
      const maxScorePerCard = 250;
      const maxXPerCard = 25;
      const active = cards.slice(0, cardCount);

      const anyFilled = active.some((c) => (c.score !== '' && c.score !== null && c.score !== undefined));
      if (!anyFilled) {
        toast.error('Please enter at least one scorecard.');
        return;
      }

      for (let i = 0; i < active.length; i++) {
        const sc = parseFloat(active[i].score);
        const xc = active[i].xCount === '' ? 0 : parseInt(active[i].xCount, 10);
        if (!Number.isFinite(sc) || sc < 0 || sc > maxScorePerCard) {
          toast.error(`Card ${i + 1}: Score must be between 0 and ${maxScorePerCard}.`);
          return;
        }
        if (!Number.isInteger(xc) || xc < 0 || xc > maxXPerCard) {
          toast.error(`Card ${i + 1}: X Count must be between 0 and ${maxXPerCard}.`);
          return;
        }
      }

      const batchId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const payloads = active.map((c, idx) => ({
        competitionId: selectedCompetition,
        category: data.category,
        score: Math.round(parseFloat(c.score)),
        // No shots in simple mode; provide X-count directly
        tiebreakerData: {
          xCount: c.xCount === '' ? 0 : parseInt(c.xCount, 10),
        },
        reportingMode: 'simple',
        batchId,
        cardIndex: idx + 1,
        cardsInBatch: cardCount,
      }));

      submitScoreMutation.mutate(payloads);
      return;
    }

    // Advanced mode (optional): shot-by-shot scoring for a single scorecard
    const totalScore = calculateTotalScore();
    const requiredShots = selectedComp?.shotsPerTarget || 10;
    const filledShots = shotScores.filter((v) => v && v.value !== '' && v.value !== null && v.value !== undefined);
    if (filledShots.length !== requiredShots) {
      toast.error(`This competition requires ${requiredShots} shots. You entered ${filledShots.length}.`);
      return;
    }
    if (totalScore === 0) {
      toast.error('Please enter at least one shot score');
      return;
    }

    const payload = {
      competitionId: selectedCompetition,
      category: data.category,
      score: Math.round(totalScore),
      shots: shotScores
        .map((s) => ({ value: parseInt((s?.value ?? '0'), 10) || 0, isX: s?.isX === true }))
        .filter((s) => Number.isInteger(s.value))
        .slice(0, requiredShots),
      reportingMode: 'advanced',
    };

    submitScoreMutation.mutate(payload);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">Submit Score</h1>
        <p className="text-white drop-shadow-md">Submit your competition score with verification</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Competition Selection */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Competition Details
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Competition *
              </label>
              <select
                value={selectedCompetition}
                onChange={(e) => setSelectedCompetition(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Choose a competition...</option>
                {availableCompetitions.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.title} - {
                      comp.schedule?.competitionDate
                        ? new Date(comp.schedule.competitionDate).toLocaleDateString()
                        : comp.startDate
                        ? new Date(comp.startDate).toLocaleDateString()
                        : 'TBD'
                    }
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Competition
              </label>
              <input
                type="date"
                {...register('competitionDate')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weapon Category *
              </label>
              <select
                {...register('category', { required: 'Please select a weapon category' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select category...</option>
                <option value="22LR">22LR</option>
                <option value="Airgun 22cal">Airgun 22cal</option>
              </select>
              {errors.category && (
                <p className="text-red-600 text-sm mt-1">{errors.category.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Score Reporting */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Score Reporting
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              type="button"
              onClick={() => setReportMode('simple')}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                reportMode === 'simple'
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Simple (recommended)
            </button>
            <button
              type="button"
              onClick={() => setReportMode('advanced')}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                reportMode === 'advanced'
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Advanced (shot-by-shot)
            </button>
          </div>

          {reportMode === 'simple' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-gray-700">
                  Enter up to <strong>4 scorecards</strong> at once. Each card is max <strong>250</strong> and <strong>25X</strong>.
                </p>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Cards</label>
                  <select
                    value={cardCount}
                    onChange={(e) => setCardCount(parseInt(e.target.value, 10))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Card</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Score (0–250)</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">X Count (0–25)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cards.slice(0, cardCount).map((c, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-medium text-gray-900">Card {idx + 1}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max="250"
                            step="1"
                            value={c.score}
                            onChange={(e) => updateCardField(idx, 'score', e.target.value)}
                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="250"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max="25"
                            step="1"
                            value={c.xCount}
                            onChange={(e) => updateCardField(idx, 'xCount', e.target.value)}
                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="25"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {simpleTotals.totalScore.toFixed(1)} ({simpleTotals.totalX}X)
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Tip: this will submit <strong>{cardCount}</strong> score entries (one per card) so leaderboards stay accurate.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Optional: enter each shot for a single scorecard (good for tech-savvy shooters).
                Required shots for this competition: <strong>{selectedComp?.shotsPerTarget || 10}</strong>
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-3 mb-4">
                {shotScores.map((shot, index) => (
                  <div key={index} className="text-center">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Shot {index + 1}
                    </label>
                    <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2 sm:justify-center">
                      <select
                        value={shot.value}
                        onChange={(e) => handleShotValueChange(index, e.target.value)}
                        className="w-14 sm:w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                          onChange={(e) => handleShotXToggle(index, e.target.checked)}
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
                  <span className="text-2xl font-bold text-blue-600">{calculateTotalScore()} ({calculateXCount()}X)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => {
              reset();
              const count = selectedComp?.shotsPerTarget || 10;
              setShotScores(Array(count).fill({ value: '', isX: false }));
              setCards(Array.from({ length: 4 }, () => ({ score: '', xCount: '' })));
              setCardCount(4);
              setReportMode('simple');
            }}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset Form
          </button>
          <button
            type="submit"
            disabled={submitScoreMutation.isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {submitScoreMutation.isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Submit Score
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ScoreSubmission;
