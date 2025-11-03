export const SkeletonLoader = () => {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 bg-gray-700 rounded w-1/3" />
      <div className="h-4 bg-gray-800 rounded w-2/3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
            <div className="h-5 bg-gray-700 rounded w-2/3" />
            <div className="h-4 bg-gray-700 rounded w-1/2" />
            <div className="h-4 bg-gray-700 rounded w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonLoader;

