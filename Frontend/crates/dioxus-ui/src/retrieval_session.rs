use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Default, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
enum Phase {
    #[default]
    Idle,
    Prepared,
    Sending,
    Responded,
    Bypassed,
    Failed,
}

#[derive(Clone, Copy, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ContextMode {
    None,
    Full,
    Limited,
}

#[derive(PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Reference {
    id: String,
    content_key: String,
    score: Option<f64>,
    score_kind: Option<ScoreKind>,
}

#[derive(PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
enum ScoreKind {
    Lexical,
    Rank,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Retrieval {
    phase: Phase,
    query_present: bool,
    query_key: String,
    count: usize,
    top: String,
    ids: Vec<String>,
    references: Vec<Reference>,
    context_mode: Option<ContextMode>,
    response_id: Option<String>,
}

impl Retrieval {
    pub(crate) fn observe(&mut self, next: Self) -> bool {
        if matches!(
            self.phase,
            Phase::Responded | Phase::Bypassed | Phase::Failed
        ) {
            if !next.query_present {
                return std::mem::replace(&mut self.query_present, false);
            }
            if self.query_present && !self.query_key.is_empty() && self.query_key == next.query_key
            {
                return false;
            }
        }
        if self.phase == next.phase
            && self.query_present == next.query_present
            && self.query_key == next.query_key
            && self.references == next.references
        {
            return false;
        }
        *self = next;
        true
    }

    pub(crate) fn sending(prepared: Self, query: String, include_memories: bool) -> Self {
        let query_present = prepared.query_present || !query.is_empty();
        Self {
            phase: Phase::Sending,
            query_present,
            query_key: query,
            context_mode: None,
            response_id: None,
            ..if include_memories {
                prepared
            } else {
                Self::default()
            }
        }
    }

    pub(crate) fn complete(&mut self, response_id: String, mode: Option<ContextMode>) -> bool {
        if self.phase != Phase::Sending {
            return false;
        }
        if !matches!(mode, Some(ContextMode::Full | ContextMode::Limited)) {
            self.clear_matches();
        }
        self.phase = if mode == Some(ContextMode::None) {
            Phase::Bypassed
        } else {
            Phase::Responded
        };
        self.context_mode = mode;
        self.response_id = Some(response_id);
        true
    }

    pub(crate) fn fail(&mut self) -> bool {
        if self.phase != Phase::Sending {
            return false;
        }
        self.clear_matches();
        self.phase = Phase::Failed;
        true
    }

    fn clear_matches(&mut self) {
        self.count = 0;
        self.ids.clear();
        self.top.clear();
        self.references.clear();
    }
}
