-- NULL keeps the browser timezone default until the user makes a choice.
ALTER TABLE users ADD COLUMN calendar_timezone TEXT CHECK (calendar_timezone IS NULL OR length(calendar_timezone) BETWEEN 1 AND 100);
