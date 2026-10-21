import { useEffect, useState } from "react";
import { apiBlob } from "../api";

export default function AuthImage({
  taskId,
  alt = "Attachment",
  className = "",
  style = {},
  onClick,
}) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = null;

    if (!taskId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    apiBlob(`/tasks/${taskId}/image`)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [taskId]);

  if (loading) {
    return (
      <div
        className={`auth-image-skeleton ${className}`}
        style={{
          minHeight: "48px",
          backgroundColor: "rgba(255, 255, 255, 0.08)",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
        aria-busy="true"
        aria-label="Loading image..."
      />
    );
  }

  if (error || !imageUrl) {
    return null;
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      onClick={onClick}
    />
  );
}
