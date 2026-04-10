import TestsManager from "../../components/tests/TestsManager.jsx";
import {
  createTeacherTest,
  getTeacherClasses,
  getTeacherTestById,
  getTeacherTests,
} from "../../services/teacher.service.js";

function TeacherTests() {
  return (
    <TestsManager
      actor="teacher"
      fetchTests={getTeacherTests}
      createTest={createTeacherTest}
      fetchClasses={getTeacherClasses}
      fetchTestById={getTeacherTestById}
    />
  );
}

export default TeacherTests;
