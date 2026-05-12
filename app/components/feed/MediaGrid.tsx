type MediaGridProps = {
  urls: string[];
};

export default function MediaGrid({ urls }: MediaGridProps) {
  if (!urls || urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <img
        src={urls[0]}
        alt="Post image"
        className="mt-3 w-full rounded-lg border object-cover"
      />
    );
  }

  if (urls.length === 2) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-lg border">
        {urls.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`Post image ${i + 1}`}
            className="aspect-square w-full object-cover"
          />
        ))}
      </div>
    );
  }

  if (urls.length === 3) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-lg border">
        <img
          src={urls[0]}
          alt="Post image 1"
          className="row-span-2 h-full w-full object-cover"
          style={{ minHeight: "200px" }}
        />
        <img
          src={urls[1]}
          alt="Post image 2"
          className="aspect-square w-full object-cover"
        />
        <img
          src={urls[2]}
          alt="Post image 3"
          className="aspect-square w-full object-cover"
        />
      </div>
    );
  }

  // 4+ images: 2×2 grid, last cell shows "+N more" overlay if needed
  const visible = urls.slice(0, 4);
  const extra = urls.length - 4;

  return (
    <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-lg border">
      {visible.map((url, i) => (
        <div key={i} className="relative">
          <img
            src={url}
            alt={`Post image ${i + 1}`}
            className="aspect-square w-full object-cover"
          />
          {i === 3 && extra > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-2xl font-bold text-white">+{extra}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
