-- 1. optionsカラムの追加 (存在しない場合)
-- 注意: 既存の option_a, option_b カラムは維持しますが、制約を緩和します
ALTER TABLE polls ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;
ALTER TABLE polls ALTER COLUMN option_a DROP NOT NULL;
ALTER TABLE polls ALTER COLUMN option_b DROP NOT NULL;

-- 2. 既存データの移行 (option_a/b -> options)
-- 既存の option_a, option_b, votes_a, votes_b を options 配列に変換します
-- 色は固定で red-500, blue-500 を割り当てます
-- このクエリは option_a カラムが存在する場合のみ実行してください
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'polls' AND column_name = 'option_a') THEN
        UPDATE polls
        SET options = jsonb_build_array(
            jsonb_build_object('label', option_a, 'votes', votes_a, 'color', 'bg-red-500'),
            jsonb_build_object('label', option_b, 'votes', votes_b, 'color', 'bg-blue-500')
        )
        WHERE options IS NULL OR jsonb_array_length(options) = 0;
    END IF;
END $$;

-- 3. 投票用RPC関数の作成
-- 古いシグネチャ(UUID版)がある場合は削除
DROP FUNCTION IF EXISTS vote_for_option(uuid, int);

-- 指定された poll_id の options 配列の特定インデックスの votes を +1 します
-- idがUUID型でない場合(数値など)も考慮してTEXT型で受け取り、内部でキャスト対応します
CREATE OR REPLACE FUNCTION vote_for_option(poll_id TEXT, option_index INT)
RETURNS VOID AS $$
BEGIN
  -- 行をロックして取得 (競合防止) -> update文だけでアトミック性は確保できるが、
  -- 複雑なjsonb操作を含むため、念のためupdate文単体で完結させる

  UPDATE polls
  SET options = jsonb_set(
    options,
    ARRAY[option_index::text, 'votes'],
    to_jsonb(COALESCE((options->option_index->>'votes')::int, 0) + 1)
  )
  -- polls.idの型に合わせて比較(暗黙のキャストに任せるか、明示的にキャスト)
  -- 既存データが "13" (数値文字列) の場合、idカラムは text か integer の可能性があります
  WHERE id::text = poll_id; 
END;
$$ LANGUAGE plpgsql;
