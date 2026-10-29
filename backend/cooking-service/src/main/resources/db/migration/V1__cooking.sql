CREATE TABLE game_definition(id VARCHAR(40) PRIMARY KEY,title VARCHAR(100) NOT NULL,description VARCHAR(200) NOT NULL,items VARCHAR(500) NOT NULL);
CREATE TABLE game_session(id UUID PRIMARY KEY,user_id UUID NOT NULL,definition_id VARCHAR(40) NOT NULL REFERENCES game_definition(id),state VARCHAR(24) NOT NULL,progress INTEGER NOT NULL,selected VARCHAR(500) NOT NULL,ready_at BIGINT NOT NULL,result_id VARCHAR(40),version INTEGER NOT NULL,created_at BIGINT NOT NULL);
CREATE INDEX game_session_owner ON game_session(user_id,created_at);
CREATE TABLE game_action(id UUID PRIMARY KEY,session_id UUID NOT NULL REFERENCES game_session(id) ON DELETE CASCADE,action_name VARCHAR(30) NOT NULL,created_at BIGINT NOT NULL);
INSERT INTO game_definition VALUES('soup','Sopinha do aconchego','Uma receita quentinha para dividir.','carrot,potato,pumpkin');
INSERT INTO game_definition VALUES('cookies','Biscoitinhos de carinho','Uma receita para o fim de tarde.','flour,oats,banana');
