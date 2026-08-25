declare module "google-trends-api" {
  type TrendsOptions = {
    keyword: string | string[];
    geo?: string;
    startTime?: Date;
    endTime?: Date;
  };

  function relatedQueries(options: TrendsOptions): Promise<string>;

  const googleTrends: {
    relatedQueries: typeof relatedQueries;
    autoComplete: (options: TrendsOptions) => Promise<string>;
    dailyTrends: (options: { geo?: string }) => Promise<string>;
    interestByRegion: (options: TrendsOptions) => Promise<string>;
    interestOverTime: (options: TrendsOptions) => Promise<string>;
    realTimeTrends: (options: { geo?: string; category?: string }) => Promise<string>;
    relatedTopics: (options: TrendsOptions) => Promise<string>;
  };

  export default googleTrends;
}
