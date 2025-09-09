import React, { useState } from 'react';
import { 
  TrendingUp,
  Award,
  Users,
  Info
} from 'lucide-react';
import RankLogo from '../components/RankLogo';

const ShootingClasses = () => {
  const [selectedClass, setSelectedClass] = useState(null);

  // Classification tiers data
  const classificationTiers = [
    {
      id: 'grand-master',
      name: 'Grand Master',
      icon: '👑',
      color: 'from-purple-600 to-purple-800',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      average: '249.0 – 250.0',
      xCount: '15+ average per card',
      description: 'The elite — consistently near-perfect shooters.',
      requirements: 'Consistently achieving near-perfect scores with exceptional X-count consistency.'
    },
    {
      id: 'master',
      name: 'Master',
      icon: '🏆',
      color: 'from-blue-600 to-blue-800',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      average: '247.0 – 248.9',
      xCount: '10+ average per card',
      description: 'State/national-level competitive shooters.',
      requirements: 'High-level competitive shooters with excellent consistency and precision.'
    },
    {
      id: 'diamond',
      name: 'Diamond',
      icon: '💎',
      color: 'from-cyan-600 to-cyan-800',
      bgColor: 'bg-cyan-50',
      borderColor: 'border-cyan-200',
      average: '245.0 – 246.9',
      xCount: '8+ average per card',
      description: 'High-level, highly consistent shooters — usually in the running locally.',
      requirements: 'Highly consistent shooters capable of competing at local championship levels.'
    },
    {
      id: 'platinum',
      name: 'Platinum',
      icon: '⚪',
      color: 'from-gray-600 to-gray-800',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      average: '242.0 – 244.9',
      xCount: '6+ average per card',
      description: 'Skilled shooters with potential to move up with fine-tuning.',
      requirements: 'Skilled shooters with strong fundamentals and potential for advancement.'
    },
    {
      id: 'gold',
      name: 'Gold',
      icon: '🥇',
      color: 'from-yellow-600 to-yellow-800',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      average: '238.0 – 241.9',
      xCount: '4+ average per card',
      description: 'Developing shooters, capable of mid-pack performance.',
      requirements: 'Developing shooters with solid fundamentals and competitive potential.'
    },
    {
      id: 'bronze',
      name: 'Bronze',
      icon: '🥉',
      color: 'from-orange-600 to-orange-800',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      average: 'Below 238.0',
      xCount: 'Variable',
      description: 'Beginner or learning shooter. Emphasis on improvement and fundamentals.',
      requirements: 'Beginner shooters focused on learning fundamentals and continuous improvement.'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mb-6">
          <img 
            src="/TheXringClassic.png" 
            alt="The X-Ring Classic" 
            className="h-20 w-auto mx-auto object-contain"
          />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Shooting Classes</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          The X-Ring Classic features a comprehensive classification system designed to recognize 
          skill progression and create fair competition across all levels of marksmanship.
        </p>
      </div>

      {/* Classification Banner Image */}
      <div className="text-center">
        <img 
          src="/GrandMasterClasses.png" 
          alt="Grand Master Classes Classification System" 
          className="w-full max-w-4xl mx-auto rounded-lg shadow-lg"
        />
      </div>

      {/* Classification Tiers */}
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
          📊 Classification Tiers
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {classificationTiers.map((tier) => (
            <div 
              key={tier.id}
              className={`${tier.bgColor} ${tier.borderColor} border-2 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer`}
              onClick={() => setSelectedClass(tier)}
            >
              <div className="flex items-center space-x-4 mb-4">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center`}>
                  <RankLogo classification={tier.name} size={36} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                  <p className="text-gray-600">{tier.description}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">Average Score:</span>
                  <span className="font-bold text-gray-900">{tier.average}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">X-Count:</span>
                  <span className="font-bold text-gray-900">{tier.xCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Class Details Modal */}
      {selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <RankLogo classification={selectedClass.name} size={40} />
                <h2 className="text-2xl font-bold text-gray-900">{selectedClass.name}</h2>
              </div>
              <button 
                onClick={() => setSelectedClass(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-600 text-lg">{selectedClass.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Score Requirements</h4>
                  <p className="text-gray-700">Average: <span className="font-bold">{selectedClass.average}</span></p>
                  <p className="text-gray-700">X-Count: <span className="font-bold">{selectedClass.xCount}</span></p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Class Requirements</h4>
                  <p className="text-gray-700">{selectedClass.requirements}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Additional Rules Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          📝 Additional Rules
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-3">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <h3 className="font-semibold text-gray-900">Promotion</h3>
            </div>
            <p className="text-gray-600 text-sm">
              When a shooter's average exceeds the threshold for a higher class, they are promoted at the end of the scoring cycle.
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-3">
              <Users className="w-6 h-6 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Provisional Classification</h3>
            </div>
            <p className="text-gray-600 text-sm">
              New shooters are placed in Gold class by default until 5 official cards are scored.
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-3">
              <Award className="w-6 h-6 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Season Awards</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Recognition given for Top Overall, Top X-Count, and Most Improved in addition to class winners.
            </p>
          </div>
        </div>
      </div>

      {/* Why This Works Section */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          ✅ Why This Works
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
            <p className="text-gray-700">
              <strong>Fair Competition:</strong> Keeps competition fair — new shooters don't get discouraged, while top shooters still face real competition.
            </p>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
            <p className="text-gray-700">
              <strong>Clear Progression Path:</strong> Creates a progression path (Bronze → Gold → Platinum → Diamond → Master → Grand Master).
            </p>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
            <p className="text-gray-700">
              <strong>Comprehensive Recognition:</strong> Recognizes not just point totals, but X-count consistency.
            </p>
          </div>
        </div>
      </div>

      {/* Information Section */}
      <div className="bg-blue-50 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Info className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">How Classes Work</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Class Progression</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Classes are determined by your average score across recent competitions</li>
              <li>• You need to complete the required number of competitions to qualify</li>
              <li>• Promotion to higher classes happens automatically when you meet the criteria</li>
              <li>• Your class is updated after each competition</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Competition Categories</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• <strong>Indoor:</strong> Controlled environment competitions</li>
              <li>• <strong>Outdoor:</strong> Weather-affected competitions</li>
              <li>• <strong>Overall:</strong> Combined performance across both categories</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShootingClasses;
